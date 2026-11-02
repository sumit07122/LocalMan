import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customerCount = await prisma.userRole.count({ where: { roleId: 'CUSTOMER' } });
  const providerCount = await prisma.provider.count();
  const categoryCount = await prisma.serviceCategory.count();
  const bookingCount = await prisma.booking.count();
  const bookingsByStatus = await prisma.booking.groupBy({
    by: ['currentStatus'],
    _count: { id: true },
  });

  console.log('--- DATABASE VERIFICATION METRICS ---');
  console.log(`Customers: ${customerCount}`);
  console.log(`Providers: ${providerCount}`);
  console.log(`Categories: ${categoryCount}`);
  console.log(`Total Bookings: ${bookingCount}`);
  console.log('Bookings Distribution by State:');
  for (const group of bookingsByStatus) {
    console.log(`  - ${group.currentStatus}: ${group._count.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
