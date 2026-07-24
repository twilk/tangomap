import type { Metadata } from 'next';
import '@/src/styles/knowledge.css';
import { SKILLS } from '@/src/data/skills';
import { CATEGORIES, iconSvg } from '@/src/lib/dna';
import { getCategoryOverview, hasSkillContent, getSkillContent } from '@/src/lib/knowledge';
import { TopNav } from '@/src/components/TopNav';

export const metadata: Metadata = {
  title: 'Learn — the 62 tango skills — Tango Map',
  description: 'A guide to all 62 Argentine tango skills across 13 categories, from the first steps to mastery.',
};

export default function SkillsIndex() {
  return (
    <div className="tm-profile">
      <main className="tm-wrap wide">
        <TopNav />

        <h1 className="tm-h1">Learn the dance</h1>
        <p className="tm-lead">Every one of the 62 skills, grouped into the 13 strands of your Tango DNA — what it is, how it works, and what to watch for.</p>

        {CATEGORIES.map((cat) => {
          const skills = SKILLS.filter((s) => s.tag === cat.tag).sort((a, b) => a.level - b.level);
          if (skills.length === 0) return null;
          return (
            <section className="tm-sec" id={cat.tag} key={cat.tag}>
              <h2 className="tm-catsh">
                <span className="tm-catico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(cat.icon, 18) }} />
                {cat.label}
              </h2>
              {getCategoryOverview(cat.tag) && <p className="tm-catov">{getCategoryOverview(cat.tag)}</p>}
              <ul className="tm-skgrid">
                {skills.map((s) => {
                  const c = getSkillContent(s.slug);
                  return (
                    <li key={s.slug}>
                      <a className={`tm-skcard${hasSkillContent(s.slug) ? '' : ' soon'}`} href={`/skill/${s.slug}`}>
                        <span className="tm-skcard-lvl" aria-label={`Level ${s.level}`}>L{s.level}</span>
                        <span className="tm-skcard-body">
                          <span className="tm-skcard-name">{s.name}</span>
                          {c?.tagline && <span className="tm-skcard-tag">{c.tagline}</span>}
                        </span>
                        <span className="tm-skcard-ar" aria-hidden="true">→</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
