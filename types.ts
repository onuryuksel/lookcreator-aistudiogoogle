// From ounassService.ts and others
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

// From ModelCreationForm.tsx and others
export interface Model {
  id: number;
  name: string;
  imageUrl: string;
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

// From TryOnSequence.tsx
export interface TryOnStep {
  sku: OunassSKU;
  inputImage: string;
  outputImage: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

// From LookDetail.tsx and others
export interface Look {
  id: number;
  model: Model;
  products: OunassSKU[];
  finalImage: string; // The main image for the look - now a URL
  variations: string[]; // Other generated images - now URLs
  createdAt: number; // timestamp
  visibility: 'public' | 'private';
  createdBy: string; // user email
  createdByUsername: string;
  tags?: string[];
}

// For lookboards, from LookboardsList.tsx, ViewLookboardPage.tsx
export interface Comment {
    id: string;
    author: 'client' | 'stylist';
    text: string;
    createdAt: number;
}

// FIX: Lookboard is now a template. Feedback and comments are moved to SharedLookboardInstance.
export interface Lookboard {
    id: number;
    publicId: string; // for sharing
    title: string;
    note?: string;
    lookIds: number[];
    createdAt: number;
    visibility?: 'public' | 'private';
    createdBy: string; // user email
    createdByUsername: string;
}

// NEW: Represents a unique, shareable instance of a lookboard for a specific client.
// This allows feedback to be tracked per-share, not per-board.
export interface SharedLookboardInstance {
    id: string; // The unique ID for the share link (e.g., /board/{id})
    lookboardPublicId: string; // Links to the Lookboard template
    sharedBy: string; // Email of the user who generated this specific link
    createdAt: number;
    feedbacks: Record<number, 'liked' | 'disliked'>;
    comments: Record<number, Comment[]>;
}

// From LifestyleShootPage.tsx
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

// For Authentication
export interface User {
  username: string;
  email: string;
  status: 'pending' | 'approved';
  role: 'user' | 'admin';
  createdAt: number;
  // Modern secure password fields
  hashedPassword?: string;
  salt?: string;
  // Legacy plaintext password field for migration
  password?: string;
}

// For legacy import from old studio
export interface LegacyLook {
  finalImage: string;
  productSkus: string[];
}

export type LookOverrides = Record<number, { finalImage: string }>;

// For Admin User Statistics
export interface UserStats {
    user: User;
    lookCount: number;
    productCount: number;
    boardCount: number;
    videoCount: number;
    variationCount: number; // Includes AI edits, lifestyle, videos, etc.
    lastActivity: number; // timestamp
    looksPerBoard: number;
}
