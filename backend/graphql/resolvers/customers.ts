import { customerRepository } from '../../repositories/customerRepo';
import { requireAuth, getEffectiveOwnerId } from '../../auth/context';

export const customerResolvers = {
  Query: {
    customers: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const customers = await customerRepository.getAll(ownerId);
      return customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        status: c.status,
        createdAt: c.created_at
      }));
    },
    customer: async (_: any, { id }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const c = await customerRepository.getById(id, ownerId);
      if (!c) return null;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        status: c.status,
        createdAt: c.created_at
      };
    }
  },
  Mutation: {
    createCustomer: async (_: any, { name, phone, email, address }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const customer = await customerRepository.create({ name, phone, email, address, owner_id: ownerId });
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        status: customer.status,
        createdAt: customer.created_at
      };
    },
    updateCustomer: async (_: any, { id, name, phone, email, address, status }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      const customer = await customerRepository.update(id, ownerId, { name, phone, email, address, status });
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        status: customer.status,
        createdAt: customer.created_at
      };
    },
    deleteCustomer: async (_: any, { id }: any, context: any) => {
      const user = requireAuth(context);
      const ownerId = await getEffectiveOwnerId(context);
      return await customerRepository.delete(id, ownerId);
    }
  }
};