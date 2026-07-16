<template>
	<div class="min-h-dvh bg-background text-foreground">
		<div class="flex w-full">
			<AppSidebar />
			<div class="flex min-h-dvh min-w-0 flex-1 flex-col">
				<AppHeader />
				<UMain :ui="{ base: 'min-h-0' }" class="min-w-0 flex-1 px-4 py-5">
					<slot />
				</UMain>
				<AppFooter />
			</div>
		</div>
	</div>
</template>
