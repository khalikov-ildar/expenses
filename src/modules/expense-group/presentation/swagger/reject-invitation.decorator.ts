import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';

export function RejectInvitationApi() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reject a group invitation',
      description: 'Rejects the invitation addressed to the authenticated user.',
    }),
    ApiParam({ name: 'id', description: 'Group invitation ID', type: String }),
    ApiResponse({ status: 201, description: 'The invitation was rejected.' }),
    ApiForbiddenResponse({ description: 'Only the invited user can reject this invitation.' }),
    ApiNotFoundResponse({ description: 'The invitation or related group membership was not found.' }),
    ApiConflictResponse({ description: 'The invitation or group is no longer in a state that allows this decision.' }),
  );
}
