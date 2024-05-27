<script lang="ts">
	async function confirmUsername() {
		console.log('confirming username', username);
		const batch = writeBatch(db);
		batch.set(doc(db, 'usernames', username), { uid: $user?.uid });
		batch.set(doc(db, 'users', $user!.uid), {
			username,
			photoURL: $user?.photoURL ?? null,
			published: true,
			bio: 'I am the Walrus',
			links: [
				{
					title: 'Test Link',
					url: 'https://kung.foo',
					icon: 'custom'
				}
			]
		});

		await batch.commit();

		username = '';
		isAvailable = false;
	}
</script>
