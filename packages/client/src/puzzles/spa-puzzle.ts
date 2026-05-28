import type { PuzzleJson } from '@arcantect/scorer';

const spaPuzzle: PuzzleJson = {
  id: 'spa',
  title: 'An Enchanted Signboard for the Village Theater',
  shortDescription: 'Model a CDN-fronted object-storage-hosted SPA.',
  prompt:
    "Festival week approaches, and the village theater needs an enchanted signboard to announce its performances. Visitors will come from castles, cottages, ships, and distant roads, so the signboard must be easy to find by a name they can remember. It is made only of painted notices and tiny charms that awaken in each visitor's looking glass, and those notices change rarely. But festival crowds are large. Thousands may read the same notices at once, and the theater does not want every visitor fetching them from the storehouse of originals. Build a signboard whose trusted copies can be found quickly across the kingdoms.",
  context: { tags: ['easy'] },
  initialNodes: [
    {
      id: 'preplaced-internet',
      nodeType: 'internet',
      position: { x: -320, y: 160 },
      deletable: false,
    },
    {
      id: 'preplaced-static-assets',
      nodeType: 'static_assets',
      position: { x: -320, y: -20 },
      deletable: false,
    },
  ],
  rubric: {
    requirements: [
      {
        id: 'starts-from-internet',
        label:
          'Visitors should find the signboard by a name they can remember.',
        hint: 'Use the DNS to give internet traffic a URL to visit.',
      },
      {
        id: 'needs-object-storage',
        label:
          "The signboard is made of objects, we don't need a living servant to hand out scrolls.",
        hint: "Object Storage stores static assets, ideal for things that don't change often.",
      },
      {
        id: 'assets-in-storage',
        label:
          'The painted notices must be kept in the storehouse, not scattered across the road.',
        hint: 'Connect the Static Assets to Object Storage — that is where the SPA files live.',
      },
      {
        id: 'cdn-fronts-storage',
        label:
          'Festival crowds should read nearby copies instead of all crowding the theater storehouse.',
        hint: 'A CDN should serve cached copies of the website, which it fetches from Object Storage as needed.',
      },
      {
        id: 'dns-routes-to-cdn',
        label:
          'The remembered name should send visitors not to the scrolls themselves, but to the fastest public entrance.',
        hint: 'DNS routes to the CDN instead of the Object Storage bucket.',
      },
      {
        id: 'https-certificate',
        label:
          "Every copy of the signboard must bear the theater's official seal.",
        hint: 'A certificate enables HTTPS and TLS, and should be assigned to the CDN.',
      },
      {
        id: 'storage-not-public',
        label:
          'We should probably keep the scrolls that make up the signboard inside the castle for safekeeping.',
        hint: 'The Object Storage bucket should not be directly internet-accessible — it should only be reachable through the CDN.',
      },
      {
        id: 'waf-protects-cdn',
        label:
          'Mischievous sprites should meet a protective ward before they can trouble the signboard. (Bonus)',
        hint: 'A WAF can filter malicious traffic before it reaches the CDN.',
        bonus: true,
      },
    ],
    datalogRules: `
      reaches(X, Y) :- edge(X, Y).
      reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

      associated(X, Y) :- edge(X, Y).
      associated(X, Y) :- edge(Y, X).

      // Reachability that never steps through a cdn node (used for storage-not-public).
      noCdnReach(X, Y) :- edge(X, Y), !node(X, "cdn").
      noCdnReach(X, Z) :- edge(X, Y), !node(X, "cdn"), noCdnReach(Y, Z).

      // Helper facts — used for negation-as-failure in the fail rules below.
      hasInternetToDns("yes")     :- node(I, "internet"), node(R, "dns"), edge(I, R).
      hasCdnFrontsStorage("yes")  :- node(C, "cdn"), node(S, "object_storage"), edge(C, S).
      hasDnsToCdn("yes")          :- node(R, "dns"), node(C, "cdn"), reaches(R, C).
      hasCertForCdn("yes")        :- node(A, "certificate"), node(C, "cdn"), associated(A, C).
      hasWafForCdn("yes")         :- node(W, "waf"), node(C, "cdn"), associated(W, C).
      hasAssetsInStorage("yes")   :- node(A, "static_assets"), node(S, "object_storage"), edge(A, S).

      // Storage is publicly exposed if internet can reach it without going through any CDN.
      directPublicStorage(S) :-
        node(S, "object_storage"), node(I, "internet"), noCdnReach(I, S).
      storageExposed("yes") :- directPublicStorage(_).

      req("starts-from-internet",  "pass") :- hasInternetToDns("yes").
      req("starts-from-internet",  "fail") :- !hasInternetToDns("yes").

      req("needs-object-storage",  "pass") :- node(_, "object_storage").
      req("needs-object-storage",  "fail") :- !node(_, "object_storage").

      req("assets-in-storage",     "pass") :- hasAssetsInStorage("yes").
      req("assets-in-storage",     "fail") :- !hasAssetsInStorage("yes").

      req("cdn-fronts-storage",    "pass") :- hasCdnFrontsStorage("yes").
      req("cdn-fronts-storage",    "fail") :- !hasCdnFrontsStorage("yes").

      req("dns-routes-to-cdn",     "pass") :- hasDnsToCdn("yes").
      req("dns-routes-to-cdn",     "fail") :- !hasDnsToCdn("yes").

      req("https-certificate",     "pass") :- hasCertForCdn("yes").
      req("https-certificate",     "fail") :- !hasCertForCdn("yes").

      req("storage-not-public",    "pass") :- node(_, "object_storage"), !storageExposed("yes").
      req("storage-not-public",    "fail") :- node(_, "object_storage"),  storageExposed("yes").

      req("waf-protects-cdn",      "pass") :- hasWafForCdn("yes").
      req("waf-protects-cdn",      "fail") :- !hasWafForCdn("yes").

      violation("unencrypted-cross-zone", E) :-
        edgeMeta(E, "crossesZone", "true"),
        !edgeMeta(E, "encrypted", "true").
    `,
    optimization: { maxNodes: 7, maxEdges: 7 },
  },
};

export default spaPuzzle;
