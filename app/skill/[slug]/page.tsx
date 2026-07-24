import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '@/src/styles/knowledge.css';
import { SKILLS } from '@/src/data/skills';
import { CATEGORIES, iconSvg } from '@/src/lib/dna';
import { getSkillContent } from '@/src/lib/knowledge';
import { TopNav } from '@/src/components/TopNav';
import { SkillVideo } from '@/src/components/SkillVideo';

const skillOf = (slug: string) => SKILLS.find((s) => s.slug === slug);
const catOf = (tag: string) => CATEGORIES.find((c) => c.tag === tag);

export function generateStaticParams() {
  return SKILLS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const skill = skillOf(slug);
  if (!skill) return { title: 'Skill not found — Tango Map' };
  const c = getSkillContent(slug);
  const title = `${skill.name} — Tango Map`;
  const description = c ? `${skill.name}: ${c.summary}` : `${skill.name} — an Argentine tango skill (Level ${skill.level}).`;
  return { title, description };
}

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = skillOf(slug);
  if (!skill) notFound();
  const cat = catOf(skill.tag);
  const c = getSkillContent(slug);

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav />

        <header className="tm-skhero">
          <span className="tm-skico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(cat?.icon ?? '', 26) }} />
          <div>
            <p className="tm-skcat">
              <a className="tm-skcat-link" href={`/skills#${skill.tag}`}>{cat?.label ?? skill.tag}</a> · Level {skill.level}
            </p>
            <h1 className="tm-h1">{skill.name}</h1>
            {c?.tagline && <p className="tm-sksub">{c.tagline}</p>}
          </div>
        </header>

        {c ? (
          <>
            <p className="tm-sklead">{c.summary}</p>

            {c.howItWorks && (
              <section className="tm-sec">
                <h2 className="tm-sh">How it works</h2>
                <p className="tm-skpara">{c.howItWorks}</p>
              </section>
            )}

            <section className="tm-sec">
              <h2 className="tm-sh">Cues</h2>
              <div className="tm-cues">
                {c.leaderCues?.length > 0 && (
                  <div className="tm-cuecol">
                    <div className="tm-cuehd">Leader</div>
                    <ul className="tm-cuelist">
                      {c.leaderCues.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.followerCues?.length > 0 && (
                  <div className="tm-cuecol">
                    <div className="tm-cuehd b">Follower</div>
                    <ul className="tm-cuelist">
                      {c.followerCues.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {c.commonMistakes?.length > 0 && (
              <section className="tm-sec">
                <h2 className="tm-sh">Common mistakes</h2>
                <ul className="tm-mistakes">
                  {c.commonMistakes.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </section>
            )}

            <SkillVideo slug={slug} />
          </>
        ) : (
          <p className="tm-callout">Detailed notes for this skill are coming soon.</p>
        )}

        <div className="tm-skcta">
          <a className="tm-cta ghost" href="/skills">
            <span className="tm-ar" aria-hidden="true">←</span> All skills
          </a>
          <a className="tm-cta" href="/">
            Open the map <span className="tm-ar" aria-hidden="true">→</span>
          </a>
        </div>
      </main>
    </div>
  );
}
