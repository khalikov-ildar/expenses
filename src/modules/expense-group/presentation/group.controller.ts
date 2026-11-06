import { AcceptInvitationApi } from './swagger/accept-invitation.decorator.js';
import { AddExpenseApi } from './swagger/add-expense.decorator.js';
import { CreateExpenseGroupApi } from './swagger/create-group.decorator.js';
import { LeaveGroupApi } from './swagger/leave-group.decorator.js';
import { RejectInvitationApi } from './swagger/reject-invitation.decorator.js';
import { CreateExpense, CreateExpenseCommand } from '../application/commands/create-expense.js';
import { LeaveGroup, LeaveGroupCommand } from '../application/commands/leave-group.js';
import { GroupInvitationStatus } from '../domain/group-invitation.js';
import { SecureEndpoint } from '@/modules/auth/identity/presentation/decorators/secure-endpoint.decorator.js';
import { BaseApplicationContext } from '@/shared/application/ports/application-context.js';
import { AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { CreateExpenseGroup, CreateExpenseGroupCommand } from '@expense-group/application/commands/create-group.js';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  MakeDecisionOnInvitation,
  MakeDecisionOnInvitationCommand,
} from '../application/commands/decide-invitation.js';
import { type CreateExpenseGroupDto, createExpenseGroupSchema } from './dtos/create-group.dto.js';
import { type CreateExpenseDto, createExpenseSchema } from './dtos/create-expense.dto.js';
import { GetGroupBalancesApi } from './swagger/get-group-balances.decorator.js';
import { GetGroupBalances, GetGroupBalancesQuery } from '../application/queries/get-group-balances.js';
import { GetExpensesForGroup, GetExpensesForGroupQuery } from '../application/queries/get-expenses.js';
import { GetCurrentGroups, GetCurrentGroupsQuery } from '../application/queries/get-current-groups.js';
import { normalizeOffsetPageRequest } from '@/shared/application/pagination/pagination.js';
import { type PaginationQueryDto, paginationQuerySchema } from '@/shared/presentation/dtos/pagination-query.dto.js';
import { PaginationQuery } from '@/shared/presentation/decorators/pagination-query.decorator.js';
import { GetPendingInvitations, GetPendingInvitationsQuery } from '../application/queries/get-pending-invitations.js';

@ApiTags('Expense Groups')
@Controller()
@SecureEndpoint()
export class ExpenseGroupController {
  constructor(
    private readonly createExpenseGroup: CreateExpenseGroup,
    private readonly decideInvitation: MakeDecisionOnInvitation,
    private readonly leave: LeaveGroup,
    private readonly createExpense: CreateExpense,
    private readonly getGroupBalances: GetGroupBalances,
    private readonly getGroupExpenses: GetExpensesForGroup,
    private readonly getGroups: GetCurrentGroups,
    private readonly getPendingInvites: GetPendingInvitations,
    private readonly context: BaseApplicationContext,
  ) {}

  @Post('expense-group')
  @CreateExpenseGroupApi()
  async createGroup(@Body({ schema: createExpenseGroupSchema }) dto: CreateExpenseGroupDto) {
    return this.createExpenseGroup.execute(
      new CreateExpenseGroupCommand(
        dto.groupName,
        dto.baseCurrency,
        dto.inviteeIds.map(AuthUserIdFactory.create),
        this.context.userId,
      ),
    );
  }

  @Post('expense-group/:id/leave')
  @LeaveGroupApi()
  async leaveGroup(@Param('id') id: string) {
    return this.leave.execute(new LeaveGroupCommand(id, this.context.userId));
  }

  @Post('invitations/:id/accept')
  @AcceptInvitationApi()
  async accept(@Param('id') id: string) {
    await this.decideInvitation.execute(
      new MakeDecisionOnInvitationCommand(id, this.context.userId, GroupInvitationStatus.ACCEPTED),
    );
  }

  @Post('invitations/:id/reject')
  @RejectInvitationApi()
  async reject(@Param('id') id: string) {
    await this.decideInvitation.execute(
      new MakeDecisionOnInvitationCommand(id, this.context.userId, GroupInvitationStatus.REJECTED),
    );
  }

  @Post('expense-groups/:groupId/expenses')
  @AddExpenseApi()
  async addExpense(@Param('groupId') groupId: string, @Body({ schema: createExpenseSchema }) dto: CreateExpenseDto) {
    return this.createExpense.execute(
      new CreateExpenseCommand(
        groupId,
        dto.description,
        dto.amount,
        dto.currency,
        dto.paidByMemberId,
        dto.participantMemberIds,
        this.context.userId,
      ),
    );
  }

  @Get('expense-groups/:groupId/balances')
  @GetGroupBalancesApi()
  async getBalances(@Param('groupId') groupId: string) {
    return this.getGroupBalances.execute(new GetGroupBalancesQuery(groupId, this.context.userId));
  }

  @Get('expense-groups/:groupId/expenses')
  async getExpenses(
    @Param('groupId') groupId: string,

    @Query({
      schema: paginationQuerySchema,
    })
    pagination: PaginationQueryDto,
  ) {
    return this.getGroupExpenses.execute(
      new GetExpensesForGroupQuery(
        groupId,
        this.context.userId,
        normalizeOffsetPageRequest(pagination.page, pagination.limit),
      ),
    );
  }

  @Get('expense-groups')
  async getCurrentGroups() {
    return this.getGroups.execute(new GetCurrentGroupsQuery(this.context.userId));
  }

  @Get('invitations')
  async getPendingInvitations(@PaginationQuery() query: PaginationQueryDto) {
    return this.getPendingInvites.execute(
      new GetPendingInvitationsQuery(this.context.userId, normalizeOffsetPageRequest(query.page, query.limit)),
    );
  }
}
