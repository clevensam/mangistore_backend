import { customerRepository } from '../../repositories/customerRepo';
import { requireAuth } from '../../auth/context';

export const customerResolvers = {
  Query: {
    customers: async (_: any, __: any, context: any) => {
      const user = requireAuth(context);
      const customers = await customerRepository.getAll(user.id);
      return customers.map(c => ({
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
      const c = await customerRepository.getById(id, user.id);
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
      const customer = await customerRepository.create({ name, phone, email, address, owner_id: user.id });
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
      const customer = await customerRepository.update(id, user.id, { name, phone, email, address, status });
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
      return await customerRepository.delete(id, user.id);
    }
  }
};