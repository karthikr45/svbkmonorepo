import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../../common/enums/roles.enum';
import { ParentPortalService } from '../../parent-portal/parent-portal.service';
import { AnnouncementsService } from '../../announcements/announcements.service';
import {
  IntentDefinition,
  IntentHandlerDeps,
  IntentResponse,
} from './intent.types';

interface ParentDeps {
  parentPortal: ParentPortalService;
  announcements: AnnouncementsService;
}

function deps(d: IntentHandlerDeps): ParentDeps {
  return d.services as unknown as ParentDeps;
}

function rupees(amount: string | number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

export const listMyChildrenIntent: IntentDefinition = {
  name: 'list_my_children',
  allowedRoles: [Role.PARENT],
  async handler(caller, _entities, d): Promise<IntentResponse> {
    if (!caller.tenantId) throw new ForbiddenException();
    const children = await deps(d).parentPortal.listChildren(
      caller.tenantId,
      caller.userId,
    );

    if (!children.length) {
      return {
        data: [],
        text:
          "I couldn't find any children linked to your account. " +
          'Please contact the school office if this looks wrong.',
      };
    }

    const names = children.map((c) => `${c.name} (${c.class}-${c.section})`);
    const text =
      children.length === 1
        ? `I see one child on your account: ${names[0]}.`
        : `I see ${children.length} children on your account: ${names.join(', ')}.`;

    return {
      data: children.map((c) => ({
        studentId: c.id,
        name: c.name,
        admissionNumber: c.admissionNumber,
        class: c.class,
        section: c.section,
        academicYear: c.academicYear,
      })),
      text,
      chips: children.map((c) => ({
        label: `${c.name}'s fees`,
        message: `Show ${c.name}'s pending fees`,
      })),
    };
  },
};

export const getMyChildFeesIntent: IntentDefinition = {
  name: 'get_my_child_fees',
  allowedRoles: [Role.PARENT],
  async handler(caller, entities, d): Promise<IntentResponse> {
    if (!caller.tenantId) throw new ForbiddenException();

    const children = await deps(d).parentPortal.listChildren(
      caller.tenantId,
      caller.userId,
    );
    if (!children.length) {
      return {
        data: null,
        text: "I can't find any children linked to your account.",
      };
    }

    // Resolve the requested child from extracted entities, else
    // default to the only child / the first one.
    const wantedName = (entities.childName as string | undefined)?.toLowerCase();
    const wantedAdm = (entities.admissionNumber as string | undefined)?.toUpperCase();
    const child =
      children.find(
        (c) =>
          (wantedAdm && c.admissionNumber?.toUpperCase() === wantedAdm) ||
          (wantedName && c.name?.toLowerCase().includes(wantedName)),
      ) ?? children[0];

    const view = await deps(d).parentPortal.childServices(
      caller.tenantId,
      caller.userId,
      child.id,
    );

    const outstanding = rupees(view.totalOutstanding);
    const lines: string[] = [];
    for (const svc of view.services) {
      lines.push(
        `${svc.serviceType ?? 'School'}: ${rupees(svc.totalOutstanding)} outstanding`,
      );
    }

    const summary =
      children.length > 1 ? `For ${child.name}: ` : '';
    const text =
      view.services.length === 0
        ? `${summary}No fees on file yet.`
        : `${summary}${outstanding} pending in total. ${lines.join(', ')}.`;

    return {
      data: view,
      text,
      chips: [
        { label: 'Show recent receipts', message: 'Show my recent receipts' },
        { label: 'How can I pay?', message: 'How do I pay online?' },
      ],
    };
  },
};

export const getUpcomingAnnouncementsIntent: IntentDefinition = {
  name: 'get_upcoming_announcements',
  allowedRoles: [Role.PARENT],
  async handler(caller, _entities, d): Promise<IntentResponse> {
    if (!caller.tenantId) throw new ForbiddenException();
    const items = await deps(d).announcements.findVisible(
      caller.tenantId,
      caller.role,
    );

    if (!items.length) {
      return {
        data: [],
        text: 'No upcoming announcements right now.',
      };
    }

    const top = items.slice(0, 5);
    const lines = top.map((a) => `• ${a.title}`);
    return {
      data: top.map((a) => ({
        id: a.id,
        title: a.title,
        eventDate: a.eventDate,
        publishedAt: a.publishedAt,
      })),
      text:
        `Here are the latest ${top.length} announcement${top.length === 1 ? '' : 's'}:\n` +
        lines.join('\n'),
    };
  },
};
