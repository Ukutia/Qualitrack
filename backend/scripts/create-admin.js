import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const email = process.env.ADMIN2_EMAIL || 'admin2@qualitrack.cl';
const password = process.env.ADMIN2_PASSWORD || 'Admin2026!';
const name = process.env.ADMIN2_NAME || 'Administrador Alternativo';
const role = 'admin';

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash },
    create: { email, name, passwordHash, role },
  });
  console.log('OK', user.id, user.email, user.role);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
