import prisma from '../prisma';

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  owner_id: string;
}

export class CustomerRepository {
  async getAll(ownerId: string) {
    return prisma.customer.findMany({
      where: { owner_id: ownerId },
      orderBy: { name: 'asc' }
    });
  }

  async getById(id: string, ownerId: string) {
    return prisma.customer.findFirst({
      where: { id, owner_id: ownerId }
    });
  }

  async create(input: CustomerInput) {
    return prisma.customer.create({
      data: {
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        status: 'active',
        owner_id: input.owner_id
      }
    });
  }

  async update(id: string, ownerId: string, updates: Partial<CustomerInput & { status: string }>) {
    return prisma.customer.update({
      where: { id },
      data: updates
    });
  }

  async delete(id: string, ownerId: string) {
    await prisma.customer.delete({ where: { id } });
    return true;
  }
}

export const customerRepository = new CustomerRepository();
