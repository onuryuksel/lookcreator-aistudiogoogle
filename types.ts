// FIX: Removed a self-import of the 'OunassSKU' type. This was causing a name conflict because the type is defined within this same file.
export interface OunassSKU {
  id: number;
  sku: string;
  name: string;
  urlKey: string;
  initialPrice: number;
  minPriceInAED: number;
  media: { src: string }[];
  sizesInHomeDeliveryStock: string[];
  sizeAndFit?: string[];
  division: string;
  productClass: string;
  color: string;
  subClass: string;
  season: string;
  designer: string;
  department: string;
  class: string;
  group: string;
  brand: string;
}

export interface Model {
  id?: number;
  name: string;
  imageUrl: string; // base64
  gender: string;
  ethnicity: string;
  ageAppearance: string;
  height: string;
  skinTone: string;
  hairColor: string;
  bodyShape: string;
  hairStyle: string;
  facialHair: string;
}

export interface TryOnStep {
  sku: OunassSKU;
  inputImage: string; // The image used as input for this step
  outputImage: string; // base64
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface Look {
  id?: number;
  finalImage: string; // base64
  products: OunassSKU[];
  baseImage: string; // base64 image of user or model
  createdAt: number;
  variations?: string[]; // Array of base64 images
}