import { isDiscoverTab } from '$lib/routes';

/** `/discover/{exercises|routines|programs}/{id}` */
export const match = (param: string) => isDiscoverTab(param);
