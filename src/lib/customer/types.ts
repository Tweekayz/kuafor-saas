import type { AppointmentStatus } from "@/lib/panel/types";

// Müşterinin randevu sayfası (/r/<gizli bağlantı>), görsel danışma ve
// değerlendirme tipleri.

export const MAX_IMAGES_PER_REQUEST = 3;
export const MAX_CONSULTATIONS_PER_APPOINTMENT = 3;
export const MAX_REVIEW_PHOTOS = 3;

export type ConsultationKind = "ai" | "staff";

export type Consultation = {
  id: string;
  kind: ConsultationKind;
  note: string | null;
  /** Kısa ömürlü imzalı görsel adresleri. */
  imageUrls: string[];
  aiNotes: string | null;
  staffReply: string | null;
  priceEstimate: number | null;
  createdAt: string;
};

export type CustomerReview = {
  rating: number;
  staffRating: number | null;
  comment: string | null;
  reply: string | null;
};

export type CustomerAppointment = {
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  barberName: string;
  services: string[];
  salon: { name: string; slug: string; timezone: string; currency: string; phone: string | null };
  /** null = görsel danışma bu salonda henüz etkin değil. */
  consultations: Consultation[] | null;
  /** undefined = değerlendirme özelliği henüz etkin değil; null = henüz yazılmadı. */
  review: CustomerReview | null | undefined;
  aiAvailable: boolean;
};

export type UploadTarget = { path: string; token: string };

export type UploadTargetsResult =
  | { ok: true; targets: UploadTarget[] }
  | { ok: false; message: string };

export type ConsultationResult =
  | { ok: true; consultation: Consultation }
  | { ok: false; message: string };

export type ReviewResult = { ok: true } | { ok: false; message: string };

/** Vitrin (randevu sayfası) için onaylı yorumlar ve ortalama puan. */
export type SalonReviews = {
  average: number | null;
  total: number;
  reviews: {
    id: string;
    author_name: string;
    rating: number;
    comment: string | null;
    photoUrls: string[];
    reply: string | null;
    is_featured: boolean;
    created_at: string;
  }[];
};
