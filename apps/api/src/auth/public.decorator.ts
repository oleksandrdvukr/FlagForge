import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Opts a route or controller out of the global {@link AdminGuard}. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
