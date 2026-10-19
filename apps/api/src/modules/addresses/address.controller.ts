import { FastifyRequest, FastifyReply } from 'fastify';
import { AddressService } from './address.service.js';
import { CreateAddressSchema, UpdateAddressSchema } from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';

export class AddressController {
  private addressService = new AddressService();

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const result = await this.addressService.listAddresses(request.user.id);
    return sendSuccess(reply, result, 200);
  };

  getById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const result = await this.addressService.getAddress(request.user.id, request.params.id);
    return sendSuccess(reply, result, 200);
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const validated = CreateAddressSchema.parse(request.body);
    const result = await this.addressService.createAddress(request.user.id, validated);
    return sendSuccess(reply, result, 201);
  };

  update = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const validated = UpdateAddressSchema.parse(request.body);
    const result = await this.addressService.updateAddress(
      request.user.id,
      request.params.id,
      validated
    );
    return sendSuccess(reply, result, 200);
  };

  setDefault = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const result = await this.addressService.setDefaultAddress(
      request.user.id,
      request.params.id
    );
    return sendSuccess(reply, result, 200);
  };

  delete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    const result = await this.addressService.deleteAddress(request.user.id, request.params.id);
    return sendSuccess(reply, result, 200);
  };
}
