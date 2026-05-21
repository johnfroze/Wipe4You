export async function checkGuildMember(
  discordUserId: string
) {
  const guildId =
    import.meta.env
      .VITE_DISCORD_GUILD_ID;

  const botToken =
    import.meta.env
      .VITE_DISCORD_BOT_TOKEN;

  try {
    const response =
      await fetch(
        `https://discord.com/api/guilds/${guildId}/members/${discordUserId}`,
        {
          headers: {
            Authorization: `Bot ${botToken}`,
          },
        }
      );

    return response.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}
