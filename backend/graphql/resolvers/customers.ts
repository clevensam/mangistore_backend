import { customerRepository } from '../../repositories/customerRepo';

export const customerResolvers = {
  Query: {
    customers: async () => {
      const customers = await customerRepository.getAll();
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
    customer: async (_: any, { id }: any) => {
      const c = await customerRepository.getById(id);
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
    createCustomer: async (_: any, { name, phone, email, address }: any) => {
      const customer = await customerRepository.create({ name, phone, email, address });
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
    updateCustomer: async (_: any, { id, name, phone, email, address, status }: any) => {
      const customer = await customerRepository.update(id, { name, phone, email, address, status });
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
    deleteCustomer: async (_: any, { id }: any) => {
      return await customerRepository.delete(id);
    }
  }
};