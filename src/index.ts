import dgram from "node:dgram";
import net from "node:net";
import { interpretIp } from "./InterpretIp";
import { createDNSQuery } from "./createDNSmessage";
import { parseDomainName } from "./parseDomainName";

const ROOT_DNS_SERVER = "198.41.0.4";
const PORT = 53;
let DOMAIN_TO_RESOLVE = "bard.google.com";
interface DNSRecord {
  domainName: string;
  newOffset: number;
  type: number;
  rdata: string;
}

function queryDNS(domain: string, server: string) {
  const ipVersion = net.isIP(server);
  console.log(server);
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

  //header is of 12 bytes
  let offset = 12;

  const question = parseQuestion(buffer, offset);

  //question is of 4 bytes -> 2 bytes for type and 2 bytes for class and 2 bytes for the domain name
  offset = question.newOffset + 4;

  const answerRecords = parseSections(buffer, answercount, offset);
  offset = updateOffset(answerRecords, offset);

  const authorityRecords = parseSections(buffer, authoritycount, offset);
  offset = updateOffset(authorityRecords, offset);

  const additionalRecords = parseSections(buffer, additionalcount, offset);
  offset = updateOffset(additionalRecords, offset);
  //  console.log(`answerRecords:${JSON.stringify(answerRecords)}`);
  //this means that the query is redirected to the name servers
  if (authorityRecords.length > 0 && answerRecords.length === 0) {
    let nsRecord: DNSRecord | undefined;

    //ip address is present in the additional records
    for (let i = 0; i < additionalRecords.length; i++) {
      const domain = additionalRecords[i].domainName;
      nsRecord = authorityRecords.find((record) => record.rdata === domain);
      if (nsRecord) {
        break;
      }
    }
    if (nsRecord === undefined) {
      console.log("No name server found");
      return;
    }
    console.log(`Name server found :${nsRecord?.rdata}`);

    const nsIp = additionalRecords.find(
      (record) => record.domainName === nsRecord?.rdata
    )?.rdata;
    if (nsIp) {
      queryDNS(DOMAIN_TO_RESOLVE, nsIp);
    }
  } else {
    //if the answer is a cname record
    const typeARecord = answerRecords.find((record) => record.type === 1);
    console.log(`typeARecord:${JSON.stringify(typeARecord)}`);
    if (typeARecord) {
      console.log(`Ip address found :${typeARecord?.rdata}`);
    } else {
      const cnameRecord = answerRecords[0];
      console.log(`Cname found :${cnameRecord?.rdata}`);

      //remove the last dot from the domain name
      //recursively query the name server with the new domain name
      DOMAIN_TO_RESOLVE = cnameRecord.rdata.slice(
        0,
        cnameRecord.rdata.length - 1
      );

      queryDNS(DOMAIN_TO_RESOLVE, ROOT_DNS_SERVER);
    }
    //for type A and AAAA records
    // const answerRecor = answerRecords[0];
    // console.log(`Ip address found :${answerRecor?.rdata}`);
    // }
  }
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
  // console.log(count, JSON.stringify(records));
  return records;
}

function parseRecords(buffer: Buffer, offset: number): DNSRecord {
  const domainNameData = parseDomainName(buffer, offset);
  offset = domainNameData.newOffset;

  const type = buffer.readUInt16BE(offset);

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

  if (type === 2) {
    /*
    type 2 indicates that the query is redirected to the name servers.
    In this case we do not get the Ip address in the rdata
    instead we get the refrence to the domain name to which the query is redirected
    we need to use this domain name to query the name server
    */
    const { domainName, newOffset } = parseDomainName(buffer, offset);
    offset = newOffset;
    // console.log(domainName);
    //because in ns record the rdata is a domain name
    rdata = domainName;
  } else if (type === 5) {
    const { domainName, newOffset } = parseDomainName(buffer, offset);
    offset = newOffset;

    rdata = domainName;
  } else {
    const rdataBuffer = buffer.slice(offset, offset + dataLength);

    //increase the offset by the data length
    offset += dataLength;
    const ipAddress = interpretIp(rdataBuffer, type);

    rdata = ipAddress;
  }

  return {
    domainName: domainNameData.domainName,
    newOffset: offset,
    type,
    rdata,
  };
}
function parseQuestion(buffer: Buffer, offset: number) {
  const question = parseDomainName(buffer, offset);
  return question;
}

function updateOffset(record: Array<any>, offset: number) {
  return record.length > 0 ? record[record.length - 1].newOffset : offset;
}
