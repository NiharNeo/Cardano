/**
 * Example usage of Pinata IPFS functions
 */

import { uploadMetadata, uploadImage, getIPFSUrl } from './ipfs';

// Example: Upload metadata
async function exampleUploadMetadata() {
  const metadata = {
    name: 'SkillForge Session NFT',
    description: 'A completed learning session',
    attributes: [
      { trait_type: 'skill', value: 'Cardano' },
      { trait_type: 'rating', value: 5 }
    ]
  };

  try {
    const cid = await uploadMetadata(metadata);
    console.log('Metadata CID:', cid);
    console.log('Metadata URL:', getIPFSUrl(cid));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Upload image from file path
async function exampleUploadImageFromPath() {
  const imagePath = './path/to/image.png';
  
  try {
    const cid = await uploadImage(imagePath, 'session-image.png');
    console.log('Image CID:', cid);
    console.log('Image URL:', getIPFSUrl(cid));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example: Upload image from Buffer
async function exampleUploadImageFromBuffer() {
  const fs = require('fs');
  const imageBuffer = fs.readFileSync('./path/to/image.png');
  
  try {
    const cid = await uploadImage(imageBuffer, 'session-image.png');
    console.log('Image CID:', cid);
    console.log('Image URL:', getIPFSUrl(cid));
  } catch (error) {
    console.error('Error:', error);
  }
}

export { exampleUploadMetadata, exampleUploadImageFromPath, exampleUploadImageFromBuffer };

