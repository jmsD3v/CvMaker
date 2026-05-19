export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  github: string | null
  location: string | null
}

export interface Experience {
  id: string
  user_id: string
  title: string
  company: string
  location: string | null
  start_date: string
  end_date: string | null
  description: string | null
  highlights: string[]
}

export interface Education {
  id: string
  user_id: string
  degree: string
  institution: string
  status: 'in_progress' | 'completed'
  start_year: number | null
  end_year: number | null
}

export interface Certification {
  id: string
  user_id: string
  name: string
  issuer: string
  issued_date: string | null
  category: 'cybersecurity' | 'ai' | 'dev' | 'industrial' | 'other'
  file_url: string
  file_type: string
  created_at: string
}

export interface GenerateRequest {
  job_posting_text: string
  user_id: string
}

export interface ExtractedCert {
  name: string
  issuer: string
  issued_date: string | null
  category: string
}
