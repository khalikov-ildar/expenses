import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';

export function AddExpenseApi() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an expense to a group',
      description:
        'Creates an expense for an active group and splits its base-currency amount equally between the participants.',
    }),
    ApiParam({ name: 'groupId', description: 'Expense group ID', type: String }),
    ApiBody({
      description: 'Expense details. Amount is a decimal string to avoid floating-point precision loss.',
      schema: {
        type: 'object',
        required: ['description', 'amount', 'currency', 'paidByMemberId', 'participantMemberIds'],
        properties: {
          description: { type: 'string', minLength: 1, maxLength: 256, example: 'Dinner' },
          amount: { type: 'string', pattern: '^(0|[1-9]\\d*)(?:\\.\\d+)?$', example: '42.50' },
          currency: { type: 'string', pattern: '^[A-Za-z]{3}$', example: 'EUR' },
          paidByMemberId: { type: 'string', example: 'member-id-1' },
          participantMemberIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
            example: ['member-id-1', 'member-id-2'],
          },
        },
      },
    }),
    // Was: ApiResponse({ ..., standardSchema: createExpenseResponseSchema }) —
    // `standardSchema` is not a recognized @nestjs/swagger option and was
    // silently ignored, so the documented response had no schema at all.
    ApiResponse({
      status: 201,
      description: 'The expense was created.',
      schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', example: 'expense-id' } },
      },
    }),
    ApiBadRequestResponse({ description: 'The request body or one of its values is invalid.' }),
    ApiForbiddenResponse({ description: 'The payer and all participants must be active members of this group.' }),
    ApiNotFoundResponse({ description: 'The group or one of its members was not found.' }),
    ApiConflictResponse({
      description: 'The group is not active or its state changed while the expense was being created.',
    }),
  );
}
