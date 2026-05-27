import { useGameStore } from '@store';

function verdictConfig(passed: boolean, perfect: boolean) {
  if (perfect) {
    return {
      modifier: 'perfect',
      icon: '✦',
      heading: 'The Council grants you the Seal of Mastery.',
      subtext: null,
    } as const;
  }
  if (passed) {
    return {
      modifier: 'passed',
      icon: '✦',
      heading: 'Your design is sanctioned by the Council.',
      subtext: null,
    } as const;
  }
  return {
    modifier: 'failed',
    icon: '✗',
    heading: 'The Council of Arcantects rejects your design.',
    subtext: null,
  } as const;
}

export function ResultsScreen() {
  const puzzle = useGameStore(s => s.puzzle);
  const scoreResult = useGameStore(s => s.scoreResult);
  const nodes = useGameStore(s => s.nodes);
  const edges = useGameStore(s => s.edges);
  const goHome = useGameStore(s => s.goHome);
  const retryPuzzle = useGameStore(s => s.retryPuzzle);

  if (!puzzle || !scoreResult) return null;

  const metCount = scoreResult.requirementResults.filter(r => r.passed).length;
  const totalCount = scoreResult.requirementResults.length;
  const triggeredViolations = scoreResult.violations;
  const verdict = verdictConfig(scoreResult.passed, scoreResult.perfect);

  const rubricHasOptimization =
    'optimization' in puzzle.rubric && puzzle.rubric.optimization != null;

  return (
    <div className='results-screen'>
      <div className='results-screen__card'>
        <div className='results-screen__ornament'>✦ ✦ ✦</div>
        <h2 className='results-screen__heading'>The Council's Verdict</h2>
        <div className='results-screen__puzzle-title'>{puzzle.title}</div>

        <div
          className={`results-screen__verdict results-screen__verdict--${verdict.modifier}`}
        >
          <span className='results-screen__verdict-icon'>{verdict.icon}</span>
          <span className='results-screen__verdict-text'>
            {verdict.heading}
          </span>
        </div>

        <div className='results-screen__req-count'>
          <strong>{metCount}</strong>
          <span className='results-screen__req-count__total'>
            {' '}
            of {totalCount}
          </span>{' '}
          requirements met
        </div>

        {scoreResult.passed &&
          !scoreResult.perfect &&
          rubricHasOptimization && (
            <div className='results-screen__optimization-hint'>
              {nodes.length} runes, {edges.length} bindings used — a leaner
              design earns the Seal of Mastery.
            </div>
          )}

        {scoreResult.perfect && (
          <div className='results-screen__optimization-proof'>
            {nodes.length} runes · {edges.length} bindings
          </div>
        )}

        <div className='results-screen__section'>
          <div className='results-screen__section-title'>Requirements</div>
          <ul className='results-screen__list'>
            {scoreResult.requirementResults.map(req => (
              <li
                key={req.id}
                className={`results-screen__item ${
                  req.passed ? 'results-screen__item--passed' : ''
                }`}
              >
                <span className='results-screen__marker' aria-hidden='true'>
                  {req.passed ? '✓' : '○'}
                </span>
                <span className='results-screen__hint'>
                  {req.hint}
                  {req.bonus && (
                    <span className='results-screen__bonus'>Bonus</span>
                  )}
                </span>
                <span className='results-screen__item-status'>
                  {req.passed ? 'Met' : 'Open'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {triggeredViolations.length > 0 && (
          <div className='results-screen__section'>
            <div className='results-screen__section-title'>Violations</div>
            <ul className='results-screen__list'>
              {triggeredViolations.map((v, i) => (
                <li
                  key={i}
                  className='results-screen__item results-screen__item--violation'
                >
                  <span className='results-screen__marker' aria-hidden='true'>
                    ✗
                  </span>
                  <span className='results-screen__hint'>{v.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className='results-screen__actions'>
          <button
            className='results-screen__btn results-screen__btn--secondary'
            onClick={goHome}
          >
            Give Up
          </button>
          <button
            className='results-screen__btn results-screen__btn--primary'
            onClick={retryPuzzle}
          >
            <span>Try Again</span>
          </button>
        </div>
        <div className='results-screen__ornament' style={{ marginTop: '4px' }}>
          ✦ ✦ ✦
        </div>
      </div>
    </div>
  );
}
