import { Router } from 'express';
import { GraduateProfile, Opportunity, Startup } from './models.js';
import { role } from './auth.js';
import {
  active,
  ownedStartupIds,
  publicStartupIds,
  publicTalent,
  safeTalent,
  visible,
} from './discovery.js';
import { meetsMandatorySkills, send } from './core.js';

const defaults = {
  required: 40,
  related: 15,
  interest: 15,
  availability: 10,
  location: 10,
  evidence: 10,
};
const normalize = (value) => value?.trim().toLowerCase() || '';
const overlap = (left = [], right = []) =>
  left.filter((value) => right.some((other) => normalize(other) === normalize(value)));
const fraction = (left, right) =>
  left?.length && right?.length ? overlap(left, right).length / left.length : null;
export function match(profile, target, weights = defaults) {
  const required = target.requiredSkills || [];
  const skills = profile.skills || [];
  const interests = [...(profile.interests || []), ...(profile.preferredIndustries || [])];
  const industry = target.industry || target.startupId?.industry;
  const shared = overlap(required, skills);
  const missingSkills = skills.length ? required.filter((skill) => !shared.includes(skill)) : [];
  const evidence = profile.portfolioProjects?.flatMap((project) => project.technologies || []);
  const locationsKnown = target.location && profile.location;
  const compatible =
    target.workMode === 'remote' ||
    (locationsKnown
      ? normalize(target.location) === normalize(profile.location) && profile.workMode !== 'remote'
      : null);
  const factors = {
    required: fraction(required, skills),
    related: fraction(target.preferredSkills, skills),
    interest: industry ? fraction([industry], interests) : null,
    availability:
      target.availability && profile.availability
        ? Number(normalize(target.availability) === normalize(profile.availability))
        : null,
    location: compatible === null ? null : Number(compatible),
    evidence: fraction(required, evidence),
  };
  const applicable = Object.keys(factors).filter((key) => factors[key] !== null);
  const total = applicable.reduce((sum, key) => sum + weights[key], 0);
  const score = total
    ? Math.round(
        (100 * applicable.reduce((sum, key) => sum + weights[key] * factors[key], 0)) / total,
      )
    : null;
  const reasons = [];
  if (shared.length) reasons.push('Shared required skills: ' + shared.join(', ') + '.');
  if (missingSkills.length) reasons.push('Skills to develop: ' + missingSkills.join(', ') + '.');
  if (factors.interest) reasons.push('Matches your industry interests.');
  if (target.workMode === 'remote') reasons.push('Remote collaboration is available.');
  if (factors.evidence) reasons.push('Portfolio projects show relevant skills.');
  if (!reasons.length) reasons.push('Add more profile details for a clearer comparison.');
  return { score, reasons, missingSkills };
}
const ranked = (rows, score) =>
  rows
    .map((item) => ({ item, ...score(item) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 12);
const graduate = async (id) => (await GraduateProfile.findOne({ userId: id }).lean()) || {};
export const matches = Router();
matches.get('/startups', ...role('graduate'), async (req, res) => {
  const [profile, items] = await Promise.all([
    graduate(req.user._id),
    Startup.find(visible).sort({ createdAt: -1 }).limit(500).lean(),
  ]);
  send(
    res,
    ranked(items, (item) => match(profile, item)),
  );
});
matches.get('/opportunities', ...role('graduate'), async (req, res) => {
  const [profile, items] = await Promise.all([
    graduate(req.user._id),
    Opportunity.find({ ...active(), startupId: { $in: await publicStartupIds() } })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('startupId', 'name industry')
      .lean(),
  ]);
  send(
    res,
    ranked(
      items.filter((item) => meetsMandatorySkills(profile, item)),
      (item) => match(profile, item),
    ),
  );
});
matches.get('/graduates', ...role('startup'), async (req, res) => {
  const [company, people] = await Promise.all([
    Startup.findOne({ _id: { $in: await ownedStartupIds(req.user._id) } })
      .sort({ createdAt: -1 })
      .lean(),
    GraduateProfile.find({ visibility: true, userId: { $in: await publicTalent() } })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('userId', 'fullName avatar')
      .lean(),
  ]);
  send(res, company ? ranked(people.map(safeTalent), (item) => match(item, company)) : []);
});
