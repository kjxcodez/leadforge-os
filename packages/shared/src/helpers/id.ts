// In a real app we might use UUIDs or CUIDs here for new entities, but MongoDB will generate ObjectIds
export function generateTempId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
