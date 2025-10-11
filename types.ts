export interface OunassSKU {
  id: number;
  sku: string;
  name: string;
  urlKey: string;
  initialPrice: number;
  minPriceInAED: number;
  media: { src: string }[];
  sizesInHomeDeliveryStock: string[];
  sizeAndFit: string[];
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
  imageUrl: string;
  name: string;
  gender: 'Male' | 'Female';
  ethnicity: string;
  ageAppearance: string;
  height: string;
  skinTone: string;
  hairColor: string;
  bodyShape: string;
  hairStyle: string;
  facialHair: string;
}

export interface Look {
  id?: number;
  finalImage: string;
  products: OunassSKU[];
  baseImage: string;
  createdAt: number;
  variations?: string[]; // Optional array of image URLs
}

export type TryOnStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface TryOnStep {
  sku: OunassSKU;
  inputImage: string;
  outputImage: string;
  prompt: string;
  status: TryOnStatus;
}

// New types for the multi-step Lifestyle Shoot feature
export interface LifestyleShootUserInput {
  location: string;
  mood: string;
  time: string;
  details: string;
  visualStyle: string;
}

export interface ArtDirectorPrompt {
    scene_setting: {
        location: string;
        mood: string;
        time: string;
        details: string;
        visual_style: string;
    };
    camera_lens_specifications: {
        camera_model: string;
        lens_choices: string[];
        aperture: string;
        shutter_speed: string;
        iso: string;
        focus_mode: string;
    };
    lighting_setup: {
        key_light: string;
        fill_light: string;
        rim_back_light: string;
        modifiers: string;
        color_temp: string;
    };
    composition: {
        shot_type: string;
        camera_angle: string;
        rule_of_thirds: string;
        depth_of_field: string;
        background: string;
    };
    post_production: {
        color_grading: string;
        filters: string;
        skin_retouching: string;
        product_enhancement: string;
        output: string;
    };
    professional_director_notes: {
        model_direction: string;
        wardrobe_styling: string;
        set_design: string;
        atmosphere: string;
        brand_consistency: string;
    };
    model_direction: {
        characteristics: string;
        posing: string;
        expressions: string;
        body_language: string;
        interaction: string;
        hair_makeup: {
            hair: string;
            makeup: string;
        };
    };
}

// --- START: New Types for Lookboards ---
export interface Comment {
  id: string;
  author: 'stylist' | 'client';
  text: string;
  createdAt: number;
}

export interface Lookboard {
  id?: number;
  publicId: string;
  title: string;
  note?: string;
  lookIds: number[];
  // Key is lookId, value is the vote
  feedbacks: Record<number, 'liked' | 'disliked'>;
  // Key is lookId, value is an array of comments
  comments: Record<number, Comment[]>;
  createdAt: number;
  updatedAt: number;
}
// --- END: New Types for Lookboards ---
