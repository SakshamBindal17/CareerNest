export type MediaItem = {
  type: 'image' | 'document';
  url: string;
};

export type ReactionCounts = {
  like?: number;
  celebrate?: number;
  support?: number;
  insightful?: number;
  funny?: number;
};

export type Post = {
  post_id: number;
  body: string | null;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role: string;
  author_headline: string | null;
  comment_count: string;
  reactions: ReactionCounts | null;
  my_reaction: string | null;
  media: MediaItem[] | null;
};

// Profile-related types
export interface Experience {
    experience_id?: number;
    title: string;
    company: string;
    location?: string;
    start_date: string;
    end_date?: string;
    description?: string;
}

export interface Education {
    education_id?: number;
    school: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date?: string;
    description?: string;
}

export interface Connection {
    connection_id: number;
    sender_id: number;
    receiver_id: number;
    status: 'pending' | 'accepted' | 'rejected';
}

export interface Profile {
    user_id: number;
    full_name: string;
    email: string;
    role: string;
    department_name: string;
    headline: string;
    about: string;
    profile_icon_url: string;
    cover_photo_url: string;
    experience: Experience[];
    education: Education[];
    connection: Connection | null;
}
