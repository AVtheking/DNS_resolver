export function encodedDomainName(domain: string) {
  const domainParts = domain.split(".");
  const buffers = domainParts.map((part) => {
    const length = Buffer.from([part.length]);
    const buffer = Buffer.from(part, "ascii");
    return Buffer.concat([length, buffer]);
  });
  // Add a 0 byte to the end of the domain name
  return Buffer.concat([...buffers, Buffer.from([0])]);
}
