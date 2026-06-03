// ── Intake Form ───────────────────────────────────────────────────────────────

export interface IntakeForm {
  title: string
  origin: string
  destination: string
  start_date: string
  end_date: string
  num_travellers: number
  interests: string[]
  accommodation_style: 'budget' | 'mid' | 'luxury' | 'mix'
  budget_per_day_gbp: number
  driving_max_hours: number
  preferred_check_in?: string    // e.g. "15:00"
  preferred_check_out?: string   // e.g. "10:00"
  must_include?: string
  notes?: string
  pets?: string                  // e.g. "2 dogs" — drives dog-friendly tagging & vet contacts
}

// ── Trip Stop & Day ───────────────────────────────────────────────────────────

export type StopType =
  | 'drive' | 'hotel' | 'sightseeing' | 'activity' | 'viewpoint'
  | 'town' | 'restaurant' | 'cafe' | 'pub' | 'beach' | 'nature'
  | 'castle' | 'distillery' | 'museum' | 'fuel' | 'other'

export interface Stop {
  id?: string
  name: string
  type: StopType
  description?: string
  address?: string
  phone?: string
  website?: string
  website_label?: string         // "Book" | "Website" | "Reserve" | "Tide times" etc.
  booking_ref?: string
  notes?: string
  duration_mins?: number
  suggested?: boolean            // Claude-suggested optional stop; user can remove
  dog_friendly?: boolean         // stop explicitly welcomes dogs
  // Drive stops
  drive_time_mins?: number
  distance_km?: number
  // Hotel stops
  check_in?: string
  check_out?: string
  // User-added photo (compressed data URL, stored in trip JSON)
  photo_url?: string
}

export interface Eating {
  name: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description?: string
  address?: string
  website?: string
  booking_required?: boolean
  suggested?: boolean
  cost?: string                  // e.g. "~£15pp", "Free", "€30-40pp"
}

export interface DaySection {
  emoji: string
  title: string
  content: string
}

export interface EmergencyContact {
  name: string
  type: 'vet' | 'hospital' | 'police' | 'pharmacy' | 'breakdown' | 'other'
  phone?: string
  address?: string
  notes?: string
}

export interface Day {
  day_number: number
  date?: string
  title?: string
  overnight_location?: string
  stops: Stop[]
  eating?: Eating[]
  notes?: string
  steps?: number               // estimated steps for the day
  walking_km?: number          // estimated walking distance km
  activity_badges?: string[]   // e.g. ["🏰", "🌿", "🥃"] shown on day tab
  sections?: DaySection[]      // extra categorised notes (dog tips, cycling, etc.)
  highlight?: boolean          // featured/special day — shows gold badge in overview + tabs
}

export interface TripData {
  summary?: string
  total_days?: number
  total_distance_km?: number
  total_stops?: number
  days: Day[]
  emergency_contacts?: EmergencyContact[]
}

// ── Trip Record (DB) ──────────────────────────────────────────────────────────

export type TripStatus = 'draft' | 'generating' | 'ready' | 'error'

export interface Trip {
  id: string
  owner_id: string
  title: string
  status: TripStatus
  start_date?: string
  end_date?: string
  is_shared: boolean
  intake_form?: IntakeForm
  created_at: string
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
}

export interface UserSettings {
  user_id: string
  claude_api_key?: string
  has_claude_key: boolean
  distance_unit: 'metric' | 'imperial'
  currency: string
}

export interface Profile {
  id: string
  name: string
  home_town?: string
  vehicle_name?: string
  vehicle_type?: 'car' | 'campervan' | 'motorhome' | 'motorcycle'
  is_admin: boolean
  setup_complete: boolean
  created_at: string
}
