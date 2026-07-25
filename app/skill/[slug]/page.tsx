import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '@/src/styles/knowledge.css';
import { SKILLS, type Skill } from '@/src/data/skills';
import { CATEGORIES, iconSvg, catAnchor } from '@/src/lib/dna';
import { getSkillContent } from '@/src/lib/knowledge';
import { adjacent, prerequisites, unlocks } from '@/src/lib/skillGraph';
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
  const { prev, next } = adjacent(slug);
  const buildsOn = prerequisites(slug);
  const leadsTo = unlocks(slug);

  // A related skill as an index-style card (level badge + name + tagline).
  const card = (s: Skill) => {
    const cc = getSkillContent(s.slug);
    return (
      <li key={s.slug}>
        <a className="tm-skcard" href={`/skill/${s.slug}`}>
          <span className="tm-skcard-lvl" aria-label={`Level ${s.level}`}>L{s.level}</span>
          <span className="tm-skcard-body">
            <span className="tm-skcard-name">{s.name}</span>
            {cc?.tagline && <span className="tm-skcard-tag">{cc.tagline}</span>}
          </span>
          <span className="tm-skcard-ar" aria-hidden="true">→</span>
        </a>
      </li>
    );
  };

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav back="/skills" />

        <header className="tm-skhero">
          <span className="tm-skico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(cat?.icon ?? '', 26) }} />
          <div>
            <p className="tm-skcat">
              <a className="tm-skcat-link" href={`/skills#${catAnchor(skill.tag)}`}>{cat?.label ?? skill.tag}</a> · Level {skill.level}
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

        {(buildsOn.length > 0 || leadsTo.length > 0) && (
          <section className="tm-sec">
            <h2 className="tm-sh">Mostly useful with</h2>
            {buildsOn.length > 0 && (
              <div className="tm-usefulgrp">
                <p className="tm-usefulhd">Builds on</p>
                <ul className="tm-skgrid">{buildsOn.map(card)}</ul>
              </div>
            )}
            {leadsTo.length > 0 && (
              <div className="tm-usefulgrp">
                <p className="tm-usefulhd b">Leads to</p>
                <ul className="tm-skgrid">{leadsTo.map(card)}</ul>
              </div>
            )}
          </section>
        )}

        <div className="tm-skcta">
          <a className="tm-cta ghost" href="/skills">
            <span className="tm-ar" aria-hidden="true">←</span> All skills
          </a>
          {/* Reading about a skill should lead somewhere personal. /me redirects
              a signed-out visitor to sign-in, so the label promises the DNA
              rather than assuming they already have one. */}
          <a className="tm-cta ghost" href="/me">
            See it in your Tango DNA <span className="tm-ar" aria-hidden="true">→</span>
          </a>
          <a className="tm-cta" href="/">
            Open the map <span className="tm-ar" aria-hidden="true">→</span>
          </a>
        </div>

        {(prev || next) && (
          <nav className="tm-skpager" aria-label="Browse skills">
            {prev ? (
              <a className="tm-skpager-a" rel="prev" href={`/skill/${prev.slug}`}>
                <span className="tm-ar" aria-hidden="true">←</span>
                <span className="tm-skpager-t">
                  <span className="tm-skpager-k">Previous</span>
                  <span className="tm-skpager-n">{prev.name}</span>
                </span>
              </a>
            ) : (
              <span aria-hidden="true" />
            )}
            {next ? (
              <a className="tm-skpager-a next" rel="next" href={`/skill/${next.slug}`}>
                <span className="tm-skpager-t">
                  <span className="tm-skpager-k">Next</span>
                  <span className="tm-skpager-n">{next.name}</span>
                </span>
                <span className="tm-ar" aria-hidden="true">→</span>
              </a>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
