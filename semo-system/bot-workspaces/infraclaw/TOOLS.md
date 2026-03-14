# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## SSH Access (OCI Infrastructure)

### Bastion Jump Host
**Always use SSH Bastion Jump for OCI private VMs**

Bastion: `152.70.244.169` (user: `opc`)

### Quick Access Aliases

**Central DB**:
```bash
ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.91
```

**office-supabase**:
```bash
ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.89
```

**play-supabase**:
```bash
ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.74
```

### Common Tasks

**Check Supabase containers**:
```bash
ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.89 'docker ps | grep supabase'
```

**View Kong config**:
```bash
ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.89 'cat /opt/supabase/docker/volumes/api/kong.yml'
```

**DB Query (psql)**:
```bash
ssh -o StrictHostKeyChecking=no -J opc@152.70.244.169 opc@10.0.0.91 << 'ENDSSH'
docker exec -i pg16-primary psql -U app -d appdb
ENDSSH
```

---

## Examples (Template)

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
