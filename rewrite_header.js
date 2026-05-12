const fs = require('fs');

const content = fs.readFileSync('apps/web/src/components/layout/header.tsx', 'utf8');

let newContent = content.replace(
  `import { buttonVariants } from "@/components/ui/button"`,
  `import { buttonVariants } from "@/components/ui/button"\nimport { SearchBar } from "@/components/shared/search-bar"`
);

const headerContentMatch = newContent.match(/function HeaderContent[\s\S]*?return \([\s\S]*?<\/header>\n  \)/);
if (!headerContentMatch) throw new Error("HeaderContent not found");

const headerStaticMatch = newContent.match(/function HeaderStatic[\s\S]*?return \([\s\S]*?<\/header>\n  \)/);
if (!headerStaticMatch) throw new Error("HeaderStatic not found");

const headerSearchMatch = newContent.match(/function HeaderSearch\(\{ className \}: \{ className\?: string \}\) \{[\s\S]*?\}\n/);
if (!headerSearchMatch) throw new Error("HeaderSearch not found");

const newHeaderContent = `function HeaderContent({ userProfile }: HeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const sortParam = searchParams.get("sort")

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/88 border-b border-border/70">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col">
        {/* Top Tier */}
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8 border-b border-border/70">
          <Link
            href="/"
            className="fc-brand flex shrink-0 items-center gap-2 rounded-md py-2 pr-4 font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fotocorp home"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-2xl hidden sm:inline-block">
              foto<span className="text-accent">corp</span>
            </span>
          </Link>

          <div className="flex-1 max-w-[800px] hidden md:block px-4 ml-8">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-6">
            <Link href="/account/fotobox" className="hidden lg:flex items-center gap-2 text-sm font-medium hover:text-muted-foreground transition-colors">
              <Archive className="h-5 w-5" />
              Boards
            </Link>
            
            <div className="hidden lg:flex items-center gap-2">
              <AccountMenu userProfile={userProfile} />
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden ml-auto"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Bottom Tier */}
        <div className="hidden lg:flex h-12 items-center px-4 sm:px-6 lg:px-8">
          <nav className="flex h-full items-center gap-6" aria-label="Primary navigation">
            <MegaMenu link={{ label: "Creative", href: "/search" }} pathname={pathname} sortParam={sortParam} />
            <MegaMenu link={{ label: "Editorial", href: "/search?sort=latest" }} pathname={pathname} sortParam={sortParam} />
            <MegaMenu link={{ label: "Video", href: "/video" }} pathname={pathname} sortParam={sortParam} />
            <MegaMenu link={{ label: "Collections", href: "/categories" }} pathname={pathname} sortParam={sortParam} />
            <NavLink link={{ label: "Pricing", href: "/pricing" }} pathname={pathname} sortParam={sortParam} />
            <RoleMainLinks userProfile={userProfile} pathname={pathname} sortParam={sortParam} />
          </nav>
        </div>
      </div>

      <div
        id="mobile-nav-panel"
        className={cn(
          "overflow-hidden border-t border-border/70 bg-background transition-all duration-200 lg:hidden",
          mobileOpen ? "max-h-[calc(100vh-4rem)] overflow-y-auto opacity-100" : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <nav className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6" aria-label="Mobile navigation">
          <div className="mb-2">
            <SearchBar />
          </div>
          {MOBILE_GROUPS.map((group) => (
            <MobileLinkGroup key={group.title} group={group} pathname={pathname} sortParam={sortParam} />
          ))}
          <MobileRoleLinks userProfile={userProfile} pathname={pathname} sortParam={sortParam} />
          <MobileAccountMenu userProfile={userProfile} />
        </nav>
      </div>
    </header>
  )`;

const newHeaderStatic = `function HeaderStatic({ userProfile }: HeaderProps) {
  const pathname = "/"
  const sortParam = null
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/88 border-b border-border/70">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col">
        {/* Top Tier */}
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8 border-b border-border/70">
          <Link
            href="/"
            className="fc-brand flex shrink-0 items-center gap-2 rounded-md py-2 pr-4 font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fotocorp home"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-2xl hidden sm:inline-block">
              foto<span className="text-accent">corp</span>
            </span>
          </Link>

          <div className="flex-1 max-w-[800px] hidden md:block px-4 ml-8">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-6">
            <Link href="/account/fotobox" className="hidden lg:flex items-center gap-2 text-sm font-medium hover:text-muted-foreground transition-colors">
              <Archive className="h-5 w-5" />
              Boards
            </Link>
            
            <div className="hidden lg:flex items-center gap-2">
              <AccountMenu userProfile={userProfile} />
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden ml-auto"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Bottom Tier */}
        <div className="hidden lg:flex h-12 items-center px-4 sm:px-6 lg:px-8">
          <nav className="flex h-full items-center gap-6" aria-label="Primary navigation">
            <MegaMenu link={{ label: "Creative", href: "/search" }} pathname={pathname} sortParam={sortParam} />
            <MegaMenu link={{ label: "Editorial", href: "/search?sort=latest" }} pathname={pathname} sortParam={sortParam} />
            <MegaMenu link={{ label: "Video", href: "/video" }} pathname={pathname} sortParam={sortParam} />
            <MegaMenu link={{ label: "Collections", href: "/categories" }} pathname={pathname} sortParam={sortParam} />
            <NavLink link={{ label: "Pricing", href: "/pricing" }} pathname={pathname} sortParam={sortParam} />
            <RoleMainLinks userProfile={userProfile} pathname={pathname} sortParam={sortParam} />
          </nav>
        </div>
      </div>
    </header>
  )`;

const megaMenuStr = `function MegaMenu({ link, pathname, sortParam }: { link: HeaderLink; pathname: string; sortParam: string | null }) {
  const active = isActivePath(pathname, link.href, sortParam)

  return (
    <div className="group relative flex h-full items-center">
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full items-center gap-1 text-sm font-medium transition-colors hover:text-foreground",
          active ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-foreground" : "text-muted-foreground",
        )}
      >
        {link.label}
        <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
      </Link>
      
      {/* Dropdown panel */}
      <div className="absolute top-full left-0 z-50 hidden pt-0 group-hover:block w-[500px]">
        <div className="overflow-hidden rounded-b-2xl border border-border border-t-0 bg-background shadow-2xl">
          <div className="flex h-[280px]">
            {/* Left Sidebar */}
            <div className="w-[180px] bg-muted/20 p-4 border-r border-border flex flex-col gap-1">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">{link.label} Content</h3>
              <Link href={link.href} className="flex items-center justify-between rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground font-medium">
                Images
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Link>
              <Link href="#" className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                Videos
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Link>
              <Link href="#" className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                Illustrations
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Link>
            </div>
            
            {/* Right Content */}
            <div className="flex-1 p-6 bg-background">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{link.label} Images</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Browse millions of royalty-free images and photos, available in a variety of formats and styles.
              </p>
              <Link href={link.href} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline group/link">
                See all {link.label.toLowerCase()} images
                <span className="transition-transform group-hover/link:translate-x-1">→</span>
              </Link>

              <div className="mt-8">
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top image searches</h3>
                <div className="flex flex-wrap gap-2">
                  {['Architecture', 'Business', 'Calendar', 'Education'].map(tag => (
                    <span key={tag} className="px-3 py-1 text-xs border border-border rounded-full text-muted-foreground hover:text-foreground hover:border-foreground/50 cursor-pointer transition-colors">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
`;

newContent = newContent.replace(headerContentMatch[0], newHeaderContent);
newContent = newContent.replace(headerStaticMatch[0], newHeaderStatic);
newContent = newContent.replace(headerSearchMatch[0], megaMenuStr);

fs.writeFileSync('apps/web/src/components/layout/header.tsx', newContent);
console.log('Done!');
