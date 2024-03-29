export function interpretIp(rdata: Buffer, type: number) {
  switch (type) {
    case 1:
      return interpretIpv4(rdata);
    case 28:
      return interpretIpv6(rdata);
    default:
      return rdata.toString("ascii");
  }
}

function interpretIpv4(rdata: Buffer) {
  //convert the buffer to an array and join it with a dot as standard ipv4 representation
  return Array.from(rdata).join(".");
}

function interpretIpv6(rdata: Buffer) {
  const ipv6: Array<string> = [];

  //in IPv6 is 16 bytes long ,represented as 8 groups of hexadecimal numbers
  for (let byte = 0; byte < rdata.length; byte += 2) {
    //take the first two bytes
    const part = rdata.readUInt16BE(byte);

    //and convert them to a hexadecimal number
    const hex = part.toString(16);

    //push the hexadecimal number to the ipv6 array
    ipv6.push(hex);
  }
  //join the array with a colon as standard ipv6 representation
  return ipv6.join(":");
}
