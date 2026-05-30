import { Resend } from 'resend';

const resend = new Resend(process.env['RESEND_API_KEY']);

export async function envoyerCredentiels(params: {
  prenom:    string;
  nom:       string;
  email:     string;
  role:      string;
  societe:   string;
  password:  string;
}): Promise<void> {
  const { email, role, societe, password } = params;

  const roleLabel: Record<string, string> = {
    admin:          'Administrateur',
    conducteur:     'Conducteur de travaux',
    chef_chantier:  'Chef de chantier',
    comptable:      'Comptable',
  };

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F1EA;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- En-tête -->
        <tr>
          <td style="background:#1A1A18;padding:32px 40px;">
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:-1px;">
              Buil<span style="color:#E8520A;">D</span>Flow
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:13px;">
              Plateforme SaaS BTP — ${societe}
            </p>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:15px;color:#6B6B67;">Bonjour,</p>
            <h2 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1A1A18;">
              Votre compte BuildFlow est prêt 🎉
            </h2>
            <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.6;">
              L'administrateur de <strong>${societe}</strong> vous a créé un accès à BuildFlow
              avec le rôle <strong>${roleLabel[role] || role}</strong>.
              Voici vos identifiants de connexion :
            </p>

            <!-- Bloc identifiants -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#F5F1EA;border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #E8E4DB;">
                        <span style="font-size:12px;color:#6B6B67;text-transform:uppercase;letter-spacing:.06em;">Email</span><br>
                        <strong style="font-size:15px;color:#1A1A18;">${email}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 0 0;">
                        <span style="font-size:12px;color:#6B6B67;text-transform:uppercase;letter-spacing:.06em;">Mot de passe temporaire</span><br>
                        <strong style="font-size:18px;color:#E8520A;font-family:monospace;letter-spacing:2px;">${password}</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:#6B6B67;line-height:1.5;">
              ⚠️ Pour votre sécurité, changez ce mot de passe dès votre première connexion.
            </p>

            <!-- Bouton -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#E8520A;border-radius:8px;">
                  <a href="${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/login"
                    style="display:inline-block;padding:13px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">
                    Accéder à BuildFlow →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #E8E4DB;">
            <p style="margin:0;font-size:12px;color:#B0ADA6;line-height:1.5;">
              Cet email vous a été envoyé par BuildFlow pour le compte de ${societe}.<br>
              Si vous pensez avoir reçu cet email par erreur, ignorez-le.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from:    process.env['EMAIL_FROM'] || 'BuildFlow <onboarding@resend.dev>',
    to:      email,
    subject: `[BuildFlow] Vos identifiants de connexion — ${societe}`,
    html,
  });
}
