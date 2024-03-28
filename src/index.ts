import dgram from "node:dgram";
import net from "node:net";
import { createDNSQuery } from "./createDNSmessage";

const ROOT_DNS_SERVER = "198.41.0.4";
const PORT = 53;
const DOMAIN_TO_RESOLVE = "www.google.com";

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
  const answerRR = header.readUInt16BE(6);
  const authorityRR = header.readUInt16BE(8);
  const additionalRR = header.readUInt16BE(10);
  //   console.log(`Transaction ID: ${tranactionId}`);
  //   console.log(`Flags: ${flags}`);
  //   console.log(`Questions: ${questionCount}`);
  console.log(`Answer RRs: ${answerRR}`);
  console.log(`Authority RRs: ${authorityRR}`);
  console.log(`Additional RRs: ${additionalRR}`);
  let offset = 12;
  console.log(buffer);
  const domain = parseDomainName(buffer, offset);
  console.log(domain);
  console.log(buffer.readUInt16BE(domain.newOffset + 3));
  offset = domain.newOffset + 4;

  const record = parseSections(buffer, authorityRR, offset);
}
function isResponse(response: Buffer): boolean {
  const flags = response.readUInt16BE(2);
  return (flags & 0x8000) !== 0;
}
function parseSections(buffer: Buffer, count: number, startOffset: number) {
  let offset = startOffset;
  const records = [];

  for (let i = 0; i < count; i++) {
    const record = parseRecords(buffer, offset);
    records.push(record);
    offset = record.newOffset;
  }

  return records;
}

function parseRecords(buffer: Buffer, offset: number) {
  const domainNameData = parseDomainName(buffer, offset);
  offset = domainNameData.newOffset;

  const type = buffer.readUInt16BE(offset);
  console.log(`Type: ${type}`);
  offset += 2;
  const classValue = buffer.readUInt16BE(offset);
  console.log(`Class: ${classValue}`);
  offset += 2;
  const ttl = buffer.readUInt32BE(offset);
  console.log(`TTL: ${ttl}`);
  offset += 4;
  const dataLength = buffer.readUInt16BE(offset);
  console.log(`Data length: ${dataLength}`);
  offset += 2;

  console.log(domainNameData);
  // console.log(type)
  return {
    domainName: domainNameData.domainName,
    newOffset: offset,
  };
}

function parseDomainName(response: Buffer, offset: number) {
  let name = "";
  let hasEncounteredPointer = false;
  let originalOffset = offset;
  while (true) {
    const lengthByte = response[offset];
    if (lengthByte === 0) {
      offset++;
      break;
    }
    if (isPointer(lengthByte)) {
      if (!hasEncounteredPointer) {
        originalOffset = offset + 2;
        hasEncounteredPointer = true;
      }
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
  return ((lengthByte & 0x3f) << 8) | buffer[offset + 1];
}
function updateOffset(record: Array<any>, offset: number) {
  return record.length > 0 ? record[record.length - 1].newOffset : offset;
}
