import dgram from "node:dgram";
import net from "node:net";
import { createDNSQuery } from "./createDNSmessage";

const ROOT_DNS_SERVER = "8.8.8.8";
const PORT = 53;
const DOMAIN_TO_RESOLVE = "www.google.com";
interface DNSRecord {
  domainName: string;
  newOffset: number;
  type: number;
  rdata: string;
}
function queryDNS(domain: string, server: string) {
  const ipVersion = net.isIP(server);

  const socketType = ipVersion === 6 ? "udp6" : "udp4";
  const client = dgram.createSocket(socketType);
  const dnsQuery = createDNSQuery(domain);
  client.send(dnsQuery, PORT, server, (error) => {
    if (error) {
      console.error(`An error occurred: ${error}`);
      client.close();
    } else {
      console.log(`DNS query sent to ${server}:${PORT} for ${domain}`);
    }
  });
  client.on("message", (message) => {
    parseDNSResponse(message);
    // console.log(`Received message: ${message}`);
  });
}
queryDNS(DOMAIN_TO_RESOLVE, ROOT_DNS_SERVER);

function parseDNSResponse(buffer: Buffer) {
  if (!isResponse(buffer)) {
    console.log("This is not a response");
  }
  // Parse the response
  // Extract the IP address from the response
  // Return the IP address
  const header = buffer.slice(0, 12);
  const tranactionId = header.readUInt16BE(0);
  const questionCount = header.readUInt16BE(4);
  const answercount = header.readUInt16BE(6);
  const authoritycount = header.readUInt16BE(8);
  const additionalcount = header.readUInt16BE(10);

  let offset = 12;
  // console.log(buffer);
  const domain = parseDomainName(buffer, offset);
  // console.log(domain);
  // console.log(buffer.readUInt16BE(domain.newOffset + 3));
  offset = domain.newOffset + 4;

  const answerRecords = parseSections(buffer, answercount, offset);
  offset = updateOffset(answerRecords, offset);
  const authorityRecords = parseSections(buffer, authoritycount, offset);
  offset = updateOffset(authorityRecords, offset);
  const additionalRecords = parseSections(buffer, additionalcount, offset);
  offset = updateOffset(additionalRecords, offset);
  console.log(`Ip address found :${answerRecords[0].rdata}`);
}
function isResponse(response: Buffer): boolean {
  const flags = response.readUInt16BE(2);
  return (flags & 0x8000) !== 0;
}
function parseSections(
  buffer: Buffer,
  count: number,
  startOffset: number
): Array<DNSRecord> {
  let offset = startOffset;
  const records = [];

  for (let i = 0; i < count; i++) {
    const record = parseRecords(buffer, offset);
    records.push(record);
    offset = record.newOffset;
  }

  return records;
}

function parseRecords(buffer: Buffer, offset: number): DNSRecord {
  const domainNameData = parseDomainName(buffer, offset);
  offset = domainNameData.newOffset;
  // console.log(`Offset: ${offset}`);
  const type = buffer.readUInt16BE(offset);
  // console.log(`Type: ${type}`);
  //  skipping the type bits
  offset += 2;
  const classValue = buffer.readUInt16BE(offset);
  //  skipping the class bits
  offset += 2;
  const ttl = buffer.readUInt32BE(offset);
  //skipping the ttl bits
  offset += 4;
  const dataLength = buffer.readUInt16BE(offset);
  //skipping the data length bits
  offset += 2;
  let rdata: string;
  // console.log(domainNameData);
  if (type === 2) {
    //work in progress
    //some understandings:
    // if the type is 2 then it means it is a name server type which
    // redirects the query to the authoritative name server
    const { domainName, newOffset } = parseDomainName(buffer, offset);
    offset = newOffset;
    rdata = domainName;
  } else {
    const rdataBuffer = buffer.slice(offset, offset + dataLength);
    const ipAddress = Array.from(rdataBuffer).join(".");
    // console.log(ipAddress);
    rdata = ipAddress;
  }

  return {
    domainName: domainNameData.domainName,
    newOffset: offset,
    type,
    rdata,
  };
}

function parseDomainName(response: Buffer, offset: number) {
  let name = "";
  let hasEncounteredPointer = false;
  let originalOffset = offset;

  while (true) {
    //calculate the length of the label
    const lengthByte = response[offset];
    //if the length is 0, we have reached the end of the domain name
    if (lengthByte === 0) {
      offset++;
      break;
    }
    //checking for dns compression, if the first two bits are set, it is a pointer
    if (isPointer(lengthByte)) {
      if (!hasEncounteredPointer) {
        originalOffset = offset + 2;
        hasEncounteredPointer = true;
      }
      //calculate the offset to which the pointer is pointing
      offset = calculateOffset(lengthByte, offset, response);
      continue;
    }

    let newOffset = offset + lengthByte + 1;

    const label = response.toString("ascii", offset + 1, newOffset);
    offset = offset + lengthByte + 1;
    name = name + label + ".";
  }

  return {
    domainName: name,
    newOffset: hasEncounteredPointer ? originalOffset : offset,
  };
}
function isPointer(lengthbyte: number) {
  return (lengthbyte & 0xc0) === 0xc0;
}

function calculateOffset(lengthByte: number, offset: number, buffer: Buffer) {
  /*
  First we bit mask the first two bits by operating with 0x3f
  Then we shift the result by 8 bits to the left so that we get 8 bits zero in the right
  The first two set bit tell us that this is the pointer
  A pointer is 16 bits long, so we add the second byte to the result

*/
  return ((lengthByte & 0x3f) << 8) | buffer[offset + 1];
}
function updateOffset(record: Array<any>, offset: number) {
  return record.length > 0 ? record[record.length - 1].newOffset : offset;
}
