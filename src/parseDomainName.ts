export function parseDomainName(response: Buffer, offset: number) {
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
