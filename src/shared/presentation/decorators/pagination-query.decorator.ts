import { Query } from '@nestjs/common';
import { paginationQuerySchema } from '../dtos/pagination-query.dto.js';

export function PaginationQuery() {
  return Query({ schema: paginationQuerySchema });
}
