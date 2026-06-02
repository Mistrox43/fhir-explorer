// Registry of all simulator activities. OR Schedule is implemented first; OR
// Case activities are added in a later milestone. The coverage test iterates
// this list to guarantee every activity covers its profiles' constrained inputs.

import type { ActivityDef } from '../types';
import { SCHEDULE_ACTIVITIES } from './schedule';

export const ACTIVITIES: ActivityDef[] = [...SCHEDULE_ACTIVITIES];

export const activitiesByTrack = (track: 'schedule' | 'case'): ActivityDef[] =>
  ACTIVITIES.filter((a) => a.track === track);

export const activityById = new Map<string, ActivityDef>(ACTIVITIES.map((a) => [a.id, a]));
