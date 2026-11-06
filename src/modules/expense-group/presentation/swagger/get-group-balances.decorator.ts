import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';

export function GetGroupBalancesApi() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get group balances',
      description:
        'Returns the balance of every membership episode in the group, expressed in the group base currency.',
    }),
    ApiParam({ name: 'groupId', description: 'Expense group ID', type: String }),
    ApiResponse({
      status: 200,
      description: 'Group balances.',
      schema: {
        type: 'object',
        required: ['groupId', 'currency', 'balances'],
        properties: {
          groupId: { type: 'string' },
          currency: { type: 'string', example: 'EUR' },
          balances: {
            type: 'array',
            items: {
              type: 'object',
              required: ['memberId', 'status', 'paidMinor', 'owedMinor', 'netMinor'],
              properties: {
                memberId: { type: 'string' },
                status: { type: 'string', enum: ['INVITED', 'ACTIVE', 'LEFT', 'DECLINED', 'EXPIRED'] },
                paidMinor: { type: 'string', example: '12500' },
                owedMinor: { type: 'string', example: '10000' },
                netMinor: { type: 'string', example: '2500' },
              },
            },
          },
        },
      },
    }),
    ApiForbiddenResponse({ description: 'The caller is not an active member of this group.' }),
    ApiNotFoundResponse({ description: 'The group does not exist.' }),
  );
}
