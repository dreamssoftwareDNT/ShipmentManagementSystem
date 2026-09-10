import { z } from 'zod';
import {
  emailSchema,
  idSchema,
  optionalPhoneSchema,
  optionalText,
  pageRequestSchema,
  requiredText,
} from './common.schema';
import { UserStatus, enumValues } from '@/types/enums';

export const createUserSchema = z.object({
  fullName: requiredText(150, 'Full name'),
  email: emailSchema,
  employeeCode: optionalText(30),
  phone: optionalPhoneSchema,
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
  status: z.enum(enumValues(UserStatus)).default(UserStatus.ACTIVE),
  roleIds: z.array(idSchema).min(1, 'Assign at least one role'),
});

export const updateUserSchema = z.object({
  fullName: requiredText(150, 'Full name'),
  email: emailSchema,
  employeeCode: optionalText(30),
  phone: optionalPhoneSchema,
  status: z.enum(enumValues(UserStatus)),
  roleIds: z.array(idSchema).min(1, 'Assign at least one role'),
});

export const userQuerySchema = pageRequestSchema.extend({
  status: z.enum(enumValues(UserStatus)).optional(),
  roleId: z.string().trim().max(30).optional(),
});

export const roleSchema = z.object({
  code: requiredText(50, 'Role code').transform((value) => value.toUpperCase()),
  name: requiredText(100, 'Role name'),
  description: optionalText(400),
  permissionCodes: z.array(z.string().min(3).max(90)).default([]),
});

export const updateRoleSchema = roleSchema.omit({ code: true });

export const auditLogQuerySchema = pageRequestSchema.extend({
  entityName: z.string().trim().max(80).optional(),
  action: z.string().trim().max(40).optional(),
  userId: z.string().trim().max(30).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
