export type Category = {
  id: string
  name: string
  description: string | null
  capacity: number | null
  is_open: boolean
  sort_order: number
}
export type Registration = {
  id: string
  student_name: string
  parent_phone: string
  grade: string
  class_number: string
  category_id: string
  created_at: string
  categories?: { name: string } | null
}
