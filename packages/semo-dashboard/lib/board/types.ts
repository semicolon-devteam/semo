export interface BoardCategory {
  slug: string;
  label: string;
  sort_order: number;
  is_public_allowed: boolean;
  created_at: string;
}

export interface BoardAttachmentMeta {
  id: string;
  post_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface BoardPost {
  id: string;
  title: string;
  description: string | null;
  category_slug: string;
  uploader_id: string | null;
  uploader_email: string | null;
  uploader_name_snapshot: string | null;
  is_public: boolean;
  is_hidden: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface BoardPostWithAttachments extends BoardPost {
  attachments: BoardAttachmentMeta[];
}

export const BOARD_ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
]);

export const BOARD_MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface UploadAttachmentInput {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  file_data: Buffer;
}
