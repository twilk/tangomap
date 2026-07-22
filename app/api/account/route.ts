import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// DELETE /api/account — erase the signed-in user and ALL their data.
// progress/profile/accounts/sessions rows cascade from the users row (onDelete: 'cascade').
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  await db.delete(users).where(eq(users.id, session.user.id));
  return Response.json({ deleted: true });
}
