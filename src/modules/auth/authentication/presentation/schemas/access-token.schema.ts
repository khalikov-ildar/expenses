import { z } from 'zod';

export const accessTokenObj = z.object({ accessToken: z.string() });
