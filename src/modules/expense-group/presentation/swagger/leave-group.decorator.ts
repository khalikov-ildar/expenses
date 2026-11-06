import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiNotFoundResponse, ApiConflictResponse } from '@nestjs/swagger';

export function LeaveGroupApi() {
  return applyDecorators(
    ApiOperation({
      summary: 'Leave an expense group',
      description:
        'Removes the authenticated user from the group. If no active members remain, the pending group is cancelled.',
    }),
    ApiParam({ name: 'id', description: 'Expense group ID', type: String }),
    ApiResponse({ status: 201, description: 'The user left the expense group.' }),
    ApiNotFoundResponse({ description: 'The group or active membership was not found.' }),
    ApiConflictResponse({ description: 'The membership or group state changed concurrently.' }),
  );
}
