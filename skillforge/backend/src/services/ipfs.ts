import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';

dotenv.config();

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

/**
 * Upload JSON metadata to IPFS via Pinata
 * @param metadata - JSON object to upload
 * @returns CID (Content Identifier)
 */
export async function uploadMetadata(metadata: any): Promise<string> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API keys not configured');
  }

  try {
    const response = await axios.post<PinataResponse>(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY
        }
      }
    );

    const cid = response.data.IpfsHash;
    console.log(`✓ Metadata uploaded to IPFS: ${cid}`);
    return cid;
  } catch (error: any) {
    console.error('Error uploading metadata to IPFS:', error.response?.data || error.message);
    throw new Error(`Failed to upload metadata to IPFS: ${error.message}`);
  }
}

/**
 * Upload PNG image to IPFS via Pinata
 * @param imagePath - Path to the PNG image file or Buffer
 * @param fileName - Optional filename for the image
 * @returns CID (Content Identifier)
 */
export async function uploadImage(imagePath: string | Buffer, fileName?: string): Promise<string> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API keys not configured');
  }

  try {
    const formData = new FormData();
    
    // Handle both file path and Buffer
    if (typeof imagePath === 'string') {
      // File path
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      formData.append('file', fs.createReadStream(imagePath));
    } else {
      // Buffer
      formData.append('file', imagePath, {
        filename: fileName || 'image.png',
        contentType: 'image/png'
      });
    }
    
    // Add metadata
    const pinataMetadata = JSON.stringify({
      name: fileName || 'skillforge-session-image'
    });
    formData.append('pinataMetadata', pinataMetadata);

    // Add options (optional)
    const pinataOptions = JSON.stringify({
      cidVersion: 1
    });
    formData.append('pinataOptions', pinataOptions);

    const response = await axios.post<PinataResponse>(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    const cid = response.data.IpfsHash;
    console.log(`✓ Image uploaded to IPFS: ${cid}`);
    return cid;
  } catch (error: any) {
    console.error('Error uploading image to IPFS:', error.response?.data || error.message);
    throw new Error(`Failed to upload image to IPFS: ${error.message}`);
  }
}

/**
 * Get IPFS URL from CID
 * @param cid - Content Identifier
 * @returns Full IPFS URL
 */
export function getIPFSUrl(cid: string): string {
  return `${PINATA_GATEWAY}${cid}`;
}

// Legacy function for backward compatibility
export async function uploadToIPFS(metadata: any): Promise<{ cid: string; url: string }> {
  const cid = await uploadMetadata(metadata);
  return { cid, url: getIPFSUrl(cid) };
}

