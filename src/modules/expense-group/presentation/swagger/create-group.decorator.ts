import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse, ApiBadRequestResponse, ApiConflictResponse } from '@nestjs/swagger';

export function CreateExpenseGroupApi() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create an expense group',
      description: 'Creates a group in the pending state and sends invitations to the supplied users.',
    }),
    ApiBody({
      description: 'Expense group details and the users to invite.',
      schema: {
        type: 'object',
        required: ['groupName', 'baseCurrency', 'inviteeIds'],
        properties: {
          groupName: { type: 'string', minLength: 3, maxLength: 128, example: 'Weekend trip' },
          baseCurrency: { type: 'string', pattern: '^[A-Za-z]{3}$', example: 'EUR' },
          inviteeIds: { type: 'array', items: { type: 'string' }, example: ['user-id-1', 'user-id-2'] },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'The expense group was created.',
      schema: {
        type: 'object',
        required: ['id', 'name', 'baseCurrency'],
        properties: {
          id: { type: 'string', example: 'group-id' },
          name: { type: 'string', example: 'Weekend trip' },
          baseCurrency: { type: 'string', example: 'EUR' },
        },
      },
    }),
    ApiBadRequestResponse({ description: 'The request body is invalid.' }),
    ApiConflictResponse({ description: 'Invitee IDs are duplicated or include the group creator.' }),
  );
}
