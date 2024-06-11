import { encodedDomainName } from "./encodedDomainName";
import { generateIderntifier } from "./generateIdentifier";

export function createDNSQuery(
  domain: string,
  identifier = generateIderntifier()
) {
  //DNS Header parts
  const flags = Buffer.from([0x00, 0x00]); //No recursion
  const questionCount = Buffer.from([0x00, 0x01]); //One question
  const answerRR = Buffer.from([0x00, 0x00]); //No asnwer resource records
  const authorityRR = Buffer.from([0x00, 0x00]); //No authority resource records
  const additionalRR = Buffer.from([0x00, 0x00]); //No additional resource records

  //DNS Question parts
  const encodedDomain = encodedDomainName(domain);
  const type = Buffer.from([0x00, 0x01]); //A record
  const classbuffer = Buffer.from([0x00, 0x01]); //IN class

  const query = Buffer.concat([
    identifier,
    flags,
    questionCount,
    answerRR,
    authorityRR,
    additionalRR,
    encodedDomain,
    type,
    classbuffer,
  ]);
  return query;
}
