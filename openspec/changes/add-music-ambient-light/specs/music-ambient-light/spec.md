## ADDED Requirements

### Requirement: Toggle on the dashboard
The Musik band of the Steuerung tab SHALL show a "Musiklicht" pill that switches the music light on
and off with one tap. The pill SHALL read as lit while the music light is enabled. The setting SHALL
survive script and adapter restarts.

#### Scenario: Tap switches it off
- **WHEN** the music light is enabled and the pill is tapped
- **THEN** the music light is disabled and the pill reads as not lit

#### Scenario: Restart keeps the setting
- **WHEN** the music light is disabled and the javascript adapter restarts
- **THEN** it is still disabled afterwards

### Requirement: Ground-floor music detection without TV sound
The system SHALL treat the ground floor as playing music when at least one of the Sonos rooms
Wohnzimmer, Küche or Fernsehzimmer reports playback of a track that is not the TV input. Audio from
the TV (the soundbar's TV input) and rooms on other floors SHALL NOT count.

#### Scenario: Music in the kitchen
- **WHEN** the Küche room plays a streamed track
- **THEN** the ground floor counts as playing music

#### Scenario: TV sound through the soundbar
- **WHEN** only the Fernsehzimmer soundbar plays its TV input
- **THEN** the ground floor does not count as playing music

#### Scenario: Music upstairs only
- **WHEN** only a room outside the ground floor plays
- **THEN** the ground floor does not count as playing music

### Requirement: Ambient scene while music plays
While the music light is enabled and the ground floor plays music, the system SHALL set the ambient
lamps (kitchen colour lamp, both TV wall washers, the dining-table lamps) to the music scene. A lamp
without power (unreachable) SHALL be skipped. In stage 1 the scene is a fixed warm, dimmed scene;
later stages derive it from genre, cover colours and tempo.

#### Scenario: Music starts
- **WHEN** the music light is enabled and ground-floor music starts
- **THEN** the reachable ambient lamps switch to the music scene

#### Scenario: Unpowered dining table
- **WHEN** music starts and the dining-table lamps are unreachable
- **THEN** they receive no command and the other lamps still switch

#### Scenario: Toggle off
- **WHEN** the music light is disabled
- **THEN** no music scene is ever set, whatever plays

### Requirement: Exact restore when the music stops
Before setting the music scene the system SHALL record each ambient lamp's state (on/off,
brightness, colour). When the ground-floor music stops, or the music light is disabled while the scene
is active, the system SHALL immediately return every recorded lamp to that state; a lamp that was off
SHALL be switched off again. The record SHALL survive a script restart, so a restart during music still
restores afterwards.

#### Scenario: Music stops
- **WHEN** the music scene is active and the ground-floor music stops
- **THEN** each lamp returns to its recorded state at once, lamps that were off go off

#### Scenario: Disabled during music
- **WHEN** the music scene is active and the pill is tapped off
- **THEN** each lamp returns to its recorded state

#### Scenario: Restart during music
- **WHEN** the script restarts while the music scene is active and the music then stops
- **THEN** the lamps return to the state recorded before the music started

### Requirement: Separate zones with their own switch
The music light SHALL work per zone: the ground floor and each child's room, each with its own Sonos
room(s), its own ambient lamps and its own switch pill in the Musik band header. Zones SHALL be
independent: music in one zone changes only that zone's lamps, and each zone keeps its own snapshot.
Which Sonos rooms and lamps form a child's zone, and its label, SHALL be configured privately on the
Pi, not in the repository.

#### Scenario: Music only in a child's room
- **WHEN** only a child's Sonos room plays music and that zone's switch is on
- **THEN** only that room's lamps change; the ground-floor lamps stay as they are

#### Scenario: One zone switched off
- **WHEN** music plays in two zones and one of them is switched off
- **THEN** only the other zone shows the music scene

### Requirement: No music light for audiobooks
The system SHALL NOT treat audiobooks as music, in any zone. A track counts as an audiobook when its
album or title names an episode, chapter or part ("Folge 12", "Kapitel", "Teil 3", "Episode"), says
"Hörspiel" or "Hörbuch", or its artist is on a private list on the Pi; from stage 2 on also when the
artist's genre is spoken word or audio drama.

#### Scenario: Children's audiobook
- **WHEN** a child's room plays a track from the album "Folge 4: …"
- **THEN** the zone does not count as playing music and its lamps stay as they are

#### Scenario: Audiobook starts during music
- **WHEN** the music scene is active and the zone switches to an audiobook
- **THEN** the lamps return to their state before the music

### Requirement: The scene follows the music
From stage 2 on, the scene SHALL follow the music on every track change: the artist's genre sets
brightness and character, the dominant colours of the album cover set the colours of the colour
lamps, and the track's tempo sets the pace of colour changes. Every source SHALL have a fallback (calm
warm scene) when it yields nothing, and lookups SHALL be cached so a track or artist is looked up at
most once. Light SHALL NOT pulse on the beat.

#### Scenario: Track without data
- **WHEN** a new track starts whose artist has no known genre, no cover and no tempo
- **THEN** the lamps show the calm warm fallback scene

#### Scenario: Repeated artist
- **WHEN** a second track of the same artist starts
- **THEN** no new genre lookup is made
